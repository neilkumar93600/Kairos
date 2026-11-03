import type pg from "pg";
import { createStorage, type Storage } from "./storage";

/**
 * Logical backups (06-infrastructure 5.3, WP-13): what a dump's manifest says and the checks run against it by the
 * pgbackup cron service (against the previous dump), the worker (age, hourly) and the restore drill (row counts).
 */

export type BackupKind = "core" | "full";

export interface Manifest {
  kind: BackupKind;
  /** Storage key of the encrypted dump; in the bucket, drop the leading `backups/`. */
  object: string;
  /** The snapshot the dump and the row counts were both taken from: the replay's --since after a dump-only restore. */
  snapshotAt: string;
  startedAt: string;
  finishedAt: string;
  serverVersion: string;
  /** The pg_dump file, and what is stored: the age file. */
  plainBytes: number;
  plainSha256: string;
  bytes: number;
  sha256: string;
  /** "schema.table" to rows in the snapshot, for every table whose data the dump holds. */
  rows: Record<string, number>;
  excludedData: string[];
  /** Public keys only; the private keys never leave the emergency kit (docs/runbook/keys.md). */
  recipients: string[];
  warnings: string[];
}

/** Table data each dump leaves out (pg_dump --exclude-table-data patterns); unlogged tables never leave the database. */
export const EXCLUDED_DATA: Record<BackupKind, string[]> = {
  // Telemetry, sessions and verification codes; the core dump also leaves out jobs, rebuilt by polling.
  core: ["public.llm_calls*", "public.metrics_minute", "public.session", "public.verification", "public.jobs"],
  full: ["public.llm_calls*", "public.metrics_minute", "public.session", "public.verification"],
};

const HOUR = 3600_000;
/** Daily at 02:10 UTC plus up to an hour of dump; weekly on Sunday. */
const MAX_AGE_MS: Record<BackupKind, number> = { core: 26 * HOUR, full: 8 * 24 * HOUR };
/** R2's single PUT stops at 5 GiB (lib/storage.ts put); warn well before. */
const PUT_WARN_BYTES = 4 * 2 ** 30;

export const latestKey = (kind: BackupKind) => `backups/${kind}/latest.json`;

export const isExcluded = (table: string, patterns: string[]) =>
  patterns.some((p) => (p.endsWith("*") ? table.startsWith(p.slice(0, -1)) : table === p));

/** Signs of a bad dump next to the previous one of its kind (06-infrastructure 5.3 verification). */
export function shrinkWarnings(prev: Pick<Manifest, "rows" | "bytes"> | null, next: Pick<Manifest, "rows" | "bytes">): string[] {
  const out: string[] = [];
  for (const [table, before] of Object.entries(prev?.rows ?? {})) {
    const after = next.rows[table] ?? 0;
    if (before >= 100 && after < before * 0.8) out.push(`${table} shrank from ${before} to ${after} rows`);
  }
  if (prev && next.bytes < prev.bytes * 0.6) {
    out.push(`the dump is ${Math.round((100 * next.bytes) / prev.bytes)}% of the previous one (${next.bytes} of ${prev.bytes} bytes)`);
  }
  if (next.bytes > PUT_WARN_BYTES) out.push(`the dump is ${(next.bytes / 2 ** 30).toFixed(1)} GiB; R2's single upload stops at 5 GiB`);
  return out;
}

/** The worker's hourly view of one kind's latest manifest: stale (or missing) and the warnings it carries. */
export function backupProblems(kind: BackupKind, manifest: Manifest | null, now: number) {
  if (!manifest) return { stale: [`no ${kind} backup manifest`], warnings: [] };
  const age = now - Date.parse(manifest.finishedAt);
  const stale = age > MAX_AGE_MS[kind] ? [`the latest ${kind} dump finished ${Math.floor(age / HOUR)} hours ago`] : [];
  return { stale, warnings: manifest.warnings.map((w) => `${kind}: ${w}`) };
}

/** Tables whose restored row count differs from the manifest: an empty list is the drill's pass. */
export function countMismatches(expected: Record<string, number>, actual: Record<string, number>): string[] {
  return Object.entries(expected).flatMap(([table, rows]) =>
    actual[table] === rows ? [] : [`${table}: manifest ${rows}, restored ${actual[table] ?? "missing"}`],
  );
}

/** The permanent tables of the dumped schemas (no partitions: their parent counts them), minus excluded data. */
export async function dumpedTables(client: pg.ClientBase, kind: BackupKind): Promise<string[]> {
  const { rows } = await client.query<{ name: string }>(
    `select n.nspname || '.' || c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'drizzle') and c.relkind in ('r', 'p') and c.relpersistence = 'p' and not c.relispartition
      order by 1`,
  );
  return rows.map((r) => r.name).filter((t) => !isExcluded(t, EXCLUDED_DATA[kind]));
}

/** Exact row counts in one statement, so inside a snapshot they all see the same moment. */
export async function countRows(client: pg.ClientBase, tables: string[]): Promise<Record<string, number>> {
  if (!tables.length) return {};
  const quote = (t: string) => t.split(".").map((part) => `"${part.replaceAll('"', '""')}"`).join(".");
  const sql = tables.map((t, i) => `select $${i + 1}::text as t, count(*)::bigint as n from ${quote(t)}`).join(" union all ");
  const { rows } = await client.query<{ t: string; n: string }>(sql, tables);
  return Object.fromEntries(rows.map((r) => [r.t, Number(r.n)]));
}

/**
 * The backups bucket from the R2_* variables alone, for the processes that do not boot the api/worker env: the
 * pgbackup cron service and the owner's restore scripts. Throws naming the missing variables, never their values.
 */
export function backupsStorage(source: Record<string, string | undefined> = process.env): Storage {
  const keys = ["R2_ENDPOINT", "R2_BUCKET_BACKUPS", "R2_BACKUPS_ACCESS_KEY_ID", "R2_BACKUPS_SECRET_ACCESS_KEY"] as const;
  const missing = keys.filter((k) => !source[k]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} (the backups bucket and its token)`);
  return createStorage({
    endpoint: source.R2_ENDPOINT,
    buckets: { backups: { name: source.R2_BUCKET_BACKUPS!, accessKeyId: source.R2_BACKUPS_ACCESS_KEY_ID!, secretAccessKey: source.R2_BACKUPS_SECRET_ACCESS_KEY! } },
  });
}
