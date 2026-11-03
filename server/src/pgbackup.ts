import { spawn } from "node:child_process";
import { createHash, type Hash } from "node:crypto";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { text } from "node:stream/consumers";
import { pathToFileURL } from "node:url";
import { Encrypter } from "age-encryption";
import pg from "pg";
import { z } from "zod";
import { EXCLUDED_DATA, backupsStorage, countRows, dumpedTables, latestKey, shrinkWarnings, type BackupKind, type Manifest } from "./lib/backups";
import { logger } from "./lib/logger";
import type { Storage } from "./lib/storage";

/**
 * The pgbackup cron service (06-infrastructure 5.3, ops-63): `node dist/pgbackup.js auto` daily at 02:10 UTC writes the
 * core dump, and on Sundays the full dump too. Image: ops/pgbackup/Dockerfile (Node 22, pg_dump 18). Per dump:
 *   1. open a REPEATABLE READ transaction as kairos_backup, export its snapshot and count every dumped table in it;
 *   2. pg_dump --snapshot from that same snapshot to /tmp, so a restore's row counts match the manifest exactly;
 *   3. pg_restore --list it (the structure reads back), then stream it through age to the public recipients in
 *      BACKUP_AGE_RECIPIENTS straight into R2 `backups/<kind>/kairos-<stamp>.dump.age`, hashing both sides;
 *   4. write the manifest beside it and as `<kind>/latest.json`, with warnings against the previous one; ping
 *      HEARTBEAT_URL_BACKUP.
 * The private keys never reach this service: it only encrypts. A failure exits 1, no ping is sent, and the worker's
 * hourly backup-check reports the stale manifest. The plaintext lives on the container's ephemeral /tmp, mode 0600, for
 * the length of one dump.
 *
 * age is age-encryption (typage, by age's author), pinned exactly: streaming, constant memory, and the owner's restore
 * script decrypts with the same code on any machine; the files are standard age v1, so the age CLI decrypts them too.
 */

const envSchema = z.object({
  /** Direct (not PgBouncer: the exported snapshot needs one session), role kairos_backup (pg_read_all_data). */
  DATABASE_BACKUP_URL: z.string().url(),
  BACKUP_AGE_RECIPIENTS: z.string().min(1),
  HEARTBEAT_URL_BACKUP: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
});

/** Every variable the service reads; .railway/railway.ts gives it exactly these (server/test/railway-iac.test.ts). */
export const PGBACKUP_ENV_KEYS = [...Object.keys(envSchema.shape), "R2_ENDPOINT", "R2_BUCKET_BACKUPS", "R2_BACKUPS_ACCESS_KEY_ID", "R2_BACKUPS_SECRET_ACCESS_KEY"];

export interface BackupEnv {
  url: string;
  recipients: string[];
  heartbeat?: string;
}

/** The service's variables; R2 is read by backupsStorage. Never echoes a value. */
export function parseBackupEnv(source: Record<string, string | undefined>): BackupEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const recipients = parsed.data.BACKUP_AGE_RECIPIENTS.split(/[\s,]+/).filter(Boolean);
  if (recipients.some((r) => /AGE-SECRET-KEY/i.test(r))) {
    throw new Error("BACKUP_AGE_RECIPIENTS holds a private key: remove it from this service now and treat it as leaked (docs/runbook/keys.md)");
  }
  recipients.forEach((r, i) => {
    try {
      new Encrypter().addRecipient(r);
    } catch {
      throw new Error(`BACKUP_AGE_RECIPIENTS: recipient ${i + 1} is not an age public key (age1...)`);
    }
  });
  return { url: parsed.data.DATABASE_BACKUP_URL, recipients, heartbeat: parsed.data.HEARTBEAT_URL_BACKUP };
}

export function pgDumpArgs(kind: BackupKind, url: string, snapshot: string, file: string): string[] {
  return [
    `--dbname=${url}`,
    `--snapshot=${snapshot}`,
    "--format=custom",
    "--no-owner",
    "--no-unlogged-table-data",
    ...EXCLUDED_DATA[kind].map((p) => `--exclude-table-data=${p}`),
    `--file=${file}`,
  ];
}

/** Runs a client tool; rejects with its exit code and the end of its stderr, any `//user:password@` in it masked. */
function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}: ${stderr.trim().replace(/\/\/[^@\s]*@/g, "//***@")}`))));
  });
}

const tap = (hash: Hash) =>
  new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });

/** The file as an age stream to `recipients`, its exact length, and both checksums once the stream has been read. */
export async function encryptFile(path: string, recipients: string[]) {
  const e = new Encrypter();
  for (const r of recipients) e.addRecipient(r);
  const [plainHash, cipherHash] = [createHash("sha256"), createHash("sha256")];
  const plain = (Readable.toWeb(createReadStream(path)) as unknown as ReadableStream<Uint8Array>).pipeThrough(tap(plainHash));
  const cipher = await e.encrypt(plain);
  const bytes = cipher.size((await stat(path)).size);
  return {
    body: Readable.fromWeb(cipher.pipeThrough(tap(cipherHash)) as unknown as NodeReadableStream<Uint8Array>),
    bytes,
    digests: () => ({ plainSha256: plainHash.digest("hex"), sha256: cipherHash.digest("hex") }),
  };
}

async function readLatest(store: Pick<Storage, "get">, kind: BackupKind): Promise<Manifest | null> {
  const file = await store.get(latestKey(kind));
  if (!file) return null;
  try {
    return JSON.parse(await text(file.body)) as Manifest;
  } catch {
    return null;
  }
}

/** Adds the warnings against the previous latest, then writes the manifest beside the dump and as latest. */
export async function publish(store: Pick<Storage, "get" | "put">, unchecked: Omit<Manifest, "warnings">): Promise<Manifest> {
  const manifest: Manifest = { ...unchecked, warnings: shrinkWarnings(await readLatest(store, unchecked.kind), unchecked) };
  const body = JSON.stringify(manifest, null, 2);
  await store.put(unchecked.object.replace(/\.dump\.age$/, ".manifest.json"), body, "application/json");
  await store.put(latestKey(unchecked.kind), body, "application/json");
  return manifest;
}

async function backup(kind: BackupKind, env: BackupEnv, store: Storage): Promise<Manifest> {
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const object = `backups/${kind}/kairos-${stamp}.dump.age`;
  const file = join(tmpdir(), `kairos-${kind}-${stamp}.dump`);
  const client = new pg.Client({ connectionString: env.url, keepAlive: true });
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const { rows } = await client.query<{ snapshot: string; at: Date; version: string }>(
      "select pg_export_snapshot() as snapshot, now() as at, current_setting('server_version') as version",
    );
    const snap = rows[0]!;
    const counts = await countRows(client, await dumpedTables(client, kind));
    await run("pg_dump", pgDumpArgs(kind, env.url, snap.snapshot, file));
    await client.query("commit");
    await run("pg_restore", ["--list", file]);

    const plainBytes = (await stat(file)).size;
    const enc = await encryptFile(file, env.recipients);
    await store.put(object, enc.body, "application/octet-stream", enc.bytes);
    const manifest = await publish(store, {
      kind,
      object,
      snapshotAt: snap.at.toISOString(),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      serverVersion: snap.version,
      plainBytes,
      bytes: enc.bytes,
      ...enc.digests(),
      rows: counts,
      excludedData: EXCLUDED_DATA[kind],
      recipients: env.recipients,
    });
    logger.info({ kind, object, bytes: manifest.bytes, tables: Object.keys(counts).length, warnings: manifest.warnings }, "backup written");
    return manifest;
  } finally {
    await client.end().catch(() => {});
    await rm(file, { force: true });
  }
}

/**
 * What a run dumps. auto: the core dump, plus the full dump on Sundays (UTC) or whenever the last full dump is missing
 * or over 7.5 days old, so the first run after setup and the night after a failed Sunday make one without a hand edit.
 */
export function kindsFor(mode: string, now: number, latestFull: Pick<Manifest, "finishedAt"> | null): BackupKind[] {
  if (mode === "core" || mode === "full") return [mode];
  if (mode !== "auto") throw new Error(`unknown mode ${mode}: core, full or auto`);
  const fullDue = new Date(now).getUTCDay() === 0 || !latestFull || now - Date.parse(latestFull.finishedAt) > 7.5 * 24 * 3600_000;
  return fullDue ? ["core", "full"] : ["core"];
}

/** core|full|auto (kindsFor). */
async function main(mode = "auto"): Promise<void> {
  kindsFor(mode, Date.now(), null); // an unknown mode fails before anything connects
  process.umask(0o077);
  const env = parseBackupEnv(process.env);
  const store = backupsStorage();
  for (const kind of kindsFor(mode, Date.now(), await readLatest(store, "full"))) await backup(kind, env, store);
  if (env.heartbeat) {
    await fetch(env.heartbeat, { signal: AbortSignal.timeout(10_000) }).catch((err: Error) => logger.warn({ err }, "backup heartbeat failed"));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).then(
    () => process.exit(0),
    (err: Error) => {
      logger.error({ err }, "backup failed");
      process.exit(1);
    },
  );
}
