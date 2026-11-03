import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { Decrypter, generateX25519Identity, identityToRecipient } from "age-encryption";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { backupProblems, countMismatches, latestKey, shrinkWarnings, type Manifest } from "../src/lib/backups";
import { fakeR2 } from "./helpers/fake-r2";

const signal = vi.fn();
vi.mock("../src/lib/sentry", () => ({ signal: (...args: unknown[]) => signal(...args) }));
const { encryptFile, parseBackupEnv, pgDumpArgs, publish } = await import("../src/pgbackup");
const { processBackupCheck } = await import("../src/jobs/backup-check");

// WP-13, 06-infrastructure 5.3: nightly core and weekly full pg_dump, age-encrypted to public recipients only, with a
// manifest (row counts from the dump's own snapshot, checksums) that the worker checks hourly and a restore checks after.

const HOUR = 3600_000;
const NOW = Date.parse("2026-11-03T12:00:00Z");
const manifest = (over: Partial<Manifest> = {}): Manifest => ({
  kind: "core",
  object: "backups/core/kairos-20261103T021000Z.dump.age",
  snapshotAt: "2026-11-03T02:10:01.000Z",
  startedAt: "2026-11-03T02:10:00.000Z",
  finishedAt: "2026-11-03T02:14:00.000Z",
  serverVersion: "18.1",
  plainBytes: 1000,
  plainSha256: "a".repeat(64),
  bytes: 1200,
  sha256: "b".repeat(64),
  rows: { "public.credit_ledger": 1000, "public.applications": 50, "public.user": 10 },
  excludedData: [],
  recipients: ["age1x"],
  warnings: [],
  ...over,
});

const tmp = mkdtempSync(join(tmpdir(), "kairos-backups-test-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => signal.mockReset());

describe("parseBackupEnv", () => {
  const base = {
    DATABASE_BACKUP_URL: "postgres://kairos_backup:pw@postgres.railway.internal:5432/railway",
    R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    R2_BUCKET_BACKUPS: "kairos-backups",
    R2_BACKUPS_ACCESS_KEY_ID: "id",
    R2_BACKUPS_SECRET_ACCESS_KEY: "secret",
  };

  it("takes two public recipients, comma or space separated", async () => {
    const [a, b] = await Promise.all([generateX25519Identity().then(identityToRecipient), generateX25519Identity().then(identityToRecipient)]);
    expect(parseBackupEnv({ ...base, BACKUP_AGE_RECIPIENTS: `${a}, ${b}` }).recipients).toEqual([a, b]);
  });

  it("refuses a private key pasted as a recipient, without echoing it", async () => {
    const identity = await generateX25519Identity();
    expect(() => parseBackupEnv({ ...base, BACKUP_AGE_RECIPIENTS: identity })).toThrow(/private key/);
    try {
      parseBackupEnv({ ...base, BACKUP_AGE_RECIPIENTS: identity });
    } catch (err) {
      expect(String(err)).not.toContain(identity);
    }
  });

  it("refuses no recipient, a malformed one, and a missing database URL", () => {
    expect(() => parseBackupEnv({ ...base, BACKUP_AGE_RECIPIENTS: "" })).toThrow(/BACKUP_AGE_RECIPIENTS/);
    expect(() => parseBackupEnv({ ...base, BACKUP_AGE_RECIPIENTS: "age1notakey" })).toThrow(/recipient 1/);
    expect(() => parseBackupEnv({ ...base, DATABASE_BACKUP_URL: "", BACKUP_AGE_RECIPIENTS: "x" })).toThrow(/DATABASE_BACKUP_URL/);
  });
});

describe("pgDumpArgs", () => {
  it("dumps from the counted snapshot, custom format, no owners, no unlogged data", () => {
    const args = pgDumpArgs("core", "postgres://u@h/db", "00000003-0000001B-1", "/tmp/x.dump");
    expect(args).toEqual(expect.arrayContaining(["--snapshot=00000003-0000001B-1", "--format=custom", "--no-owner", "--no-unlogged-table-data", "--file=/tmp/x.dump"]));
  });

  it("the core dump leaves out jobs' data; the full dump keeps it; neither carries telemetry or sessions", () => {
    const excluded = (kind: "core" | "full") => pgDumpArgs(kind, "u", "s", "f").filter((a) => a.startsWith("--exclude-table-data="));
    expect(excluded("core")).toContain("--exclude-table-data=public.jobs");
    expect(excluded("full")).not.toContain("--exclude-table-data=public.jobs");
    for (const kind of ["core", "full"] as const) {
      expect(excluded(kind)).toEqual(expect.arrayContaining(["--exclude-table-data=public.llm_calls*", "--exclude-table-data=public.session", "--exclude-table-data=public.verification"]));
    }
  });
});

describe("encryptFile", () => {
  it("encrypts to the recipients only: the owner's key decrypts it, the checksums and size match", async () => {
    const identity = await generateX25519Identity();
    const other = await generateX25519Identity();
    const plain = Buffer.alloc(200_000, 7);
    plain.write("PGDMP");
    const file = join(tmp, "x.dump");
    writeFileSync(file, plain);

    const out = await encryptFile(file, [await identityToRecipient(identity), await identityToRecipient(other)]);
    const cipher = await buffer(out.body);
    expect(cipher.length).toBe(out.bytes);
    expect(cipher.subarray(0, 21).toString()).toBe("age-encryption.org/v1");
    expect(out.digests()).toEqual({
      plainSha256: createHash("sha256").update(plain).digest("hex"),
      sha256: createHash("sha256").update(cipher).digest("hex"),
    });
    const d = new Decrypter();
    d.addIdentity(identity);
    expect(Buffer.from(await d.decrypt(cipher))).toEqual(plain);
  });
});

describe("shrinkWarnings", () => {
  it("warns when a table loses over 20% of at least 100 rows, or the dump is under 60% of the previous one", () => {
    const prev = manifest();
    expect(shrinkWarnings(prev, manifest())).toEqual([]);
    expect(shrinkWarnings(prev, manifest({ rows: { ...prev.rows, "public.credit_ledger": 700, "public.applications": 5 } }))).toEqual([
      "public.credit_ledger shrank from 1000 to 700 rows",
    ]);
    expect(shrinkWarnings(prev, manifest({ bytes: 700 }))).toEqual(["the dump is 58% of the previous one (700 of 1200 bytes)"]);
    expect(shrinkWarnings(null, manifest())).toEqual([]);
  });

  it("warns as the dump nears R2's 5 GiB single upload", () => {
    expect(shrinkWarnings(null, manifest({ bytes: 4.5 * 2 ** 30 }))[0]).toMatch(/5 GiB/);
  });
});

describe("backupProblems", () => {
  it("a core dump older than 26 hours or a full dump older than 8 days is stale; none at all is too", () => {
    expect(backupProblems("core", manifest(), NOW)).toEqual({ stale: [], warnings: [] });
    expect(backupProblems("core", manifest(), Date.parse("2026-11-04T04:15:00Z")).stale[0]).toMatch(/core dump finished 26 hours ago/);
    expect(backupProblems("full", manifest({ kind: "full" }), NOW + 7 * 24 * HOUR).stale).toEqual([]);
    expect(backupProblems("full", manifest({ kind: "full" }), NOW + 8 * 24 * HOUR).stale).toHaveLength(1);
    expect(backupProblems("full", null, NOW).stale).toEqual(["no full backup manifest"]);
    expect(backupProblems("core", manifest({ warnings: ["w"] }), NOW).warnings).toEqual(["core: w"]);
  });
});

describe("countMismatches", () => {
  it("names every table whose restored count differs from the manifest", () => {
    expect(countMismatches({ "public.a": 3, "public.b": 2 }, { "public.a": 3, "public.b": 1 })).toEqual(["public.b: manifest 2, restored 1"]);
    expect(countMismatches({ "public.a": 3 }, {})).toEqual(["public.a: manifest 3, restored missing"]);
  });
});

describe("publish", () => {
  it("writes the manifest beside the dump and as latest, with warnings against the previous latest", async () => {
    const r2 = fakeR2();
    await r2.storage.put(latestKey("core"), JSON.stringify(manifest()), "application/json");
    const next = manifest({ object: "backups/core/kairos-20261104T021000Z.dump.age", bytes: 600 });
    const { warnings: _, ...unchecked } = next;
    const out = await publish(r2.storage, unchecked);
    expect(out.warnings).toEqual(["the dump is 50% of the previous one (600 of 1200 bytes)"]);
    expect(JSON.parse(r2.objects.get("kairos-backups|core/latest.json")!)).toEqual(out);
    expect(JSON.parse(r2.objects.get("kairos-backups|core/kairos-20261104T021000Z.manifest.json")!)).toEqual(out);
  });
});

describe("processBackupCheck", () => {
  it("is quiet while both dumps are fresh", async () => {
    const r2 = fakeR2();
    await r2.storage.put(latestKey("core"), JSON.stringify(manifest()), "application/json");
    await r2.storage.put(latestKey("full"), JSON.stringify(manifest({ kind: "full" })), "application/json");
    expect(await processBackupCheck(r2.storage, NOW)).toMatchObject({ stale: [], warnings: [] });
    expect(signal).not.toHaveBeenCalled();
  });

  it("signals a missing or stale dump and a manifest warning", async () => {
    const r2 = fakeR2();
    await r2.storage.put(latestKey("core"), JSON.stringify(manifest({ warnings: ["public.x shrank"] })), "application/json");
    const out = await processBackupCheck(r2.storage, NOW + 30 * HOUR);
    expect(out.stale).toHaveLength(2);
    expect(signal).toHaveBeenCalledWith("backup_stale", 2);
    expect(signal).toHaveBeenCalledWith("backup_warning", 1);
  });

  it("treats an unreadable manifest as missing", async () => {
    const r2 = fakeR2();
    await r2.storage.put(latestKey("core"), "not json", "application/json");
    await r2.storage.put(latestKey("full"), JSON.stringify(manifest({ kind: "full" })), "application/json");
    expect((await processBackupCheck(r2.storage, NOW)).stale).toEqual(["no core backup manifest"]);
  });

  it("does nothing on a process without the backups bucket", async () => {
    expect(await processBackupCheck(null)).toEqual({ skipped: "no backups bucket" });
  });

  it("the dump stream reaches R2 with its length", async () => {
    // storage.put takes a stream and its length, so a multi-GB dump is never held in memory.
    const r2 = fakeR2();
    await r2.storage.put("backups/core/x.dump.age", Readable.from([Buffer.from("abc")]), "application/octet-stream", 3);
    expect(r2.calls.at(-1)).toMatchObject({ command: "PutObjectCommand", key: "core/x.dump.age" });
  });
});
