import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The migration runner (06-infrastructure 3.7, 02-database 14.1). It reads drizzle's journal and keeps drizzle's
 * bookkeeping table, so a database migrated by drizzle's own migrator carries on unchanged. Unlike drizzle's, it
 * serializes deploys on an advisory lock, commits per file, runs `-- kairos:no-transaction` files statement by
 * statement, retries a statement that cannot get its lock, and refuses to run when an applied file was edited (INV-21).
 */

/** pg_advisory_lock key held for the whole run, so two deploys never migrate at once. */
export const MIGRATION_LOCK = 7281551;

export interface Migration {
  tag: string;
  /** The journal's `when`, stored as created_at. */
  when: number;
  /** sha256 of the file with LF line ends, then with CRLF: drizzle hashed the bytes, so a Windows checkout gives the second. */
  hashes: [string, string];
  noTransaction: boolean;
  statements: string[];
}

/** Anything with pg's query(): a pg.Client on a dedicated (unpooled) connection. */
export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface RunOptions {
  log?: (message: string, tag?: string) => void;
  /** Pause between lock retries (3 retries, 06-infrastructure 3.7). */
  retryDelayMs?: number;
  /** How long to wait for another deploy's run to release the advisory lock: the pre-deploy budget. */
  lockWaitMs?: number;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export function readMigrations(folder: string): Migration[] {
  const journal = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
  return journal.entries.map(({ tag, when }) => {
    const text = readFileSync(join(folder, `${tag}.sql`), "utf8").replace(/\r\n/g, "\n");
    return {
      tag,
      when,
      hashes: [sha256(text), sha256(text.replace(/\n/g, "\r\n"))],
      noTransaction: /^-- kairos:no-transaction\b/.test(text),
      statements: text.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean),
    };
  });
}

const LOCK_NOT_AVAILABLE = "55P03";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `attempt`, retrying up to 3 more times when it fails on lock_timeout. */
async function withLockRetry<T>(attempt: () => Promise<T>, delayMs: number, onRetry: (n: number) => void): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (err) {
      if ((err as { code?: string }).code !== LOCK_NOT_AVAILABLE || n > 3) throw err;
      onRetry(n);
      await sleep(delayMs);
    }
  }
}

/** Applies every pending migration in journal order. Returns the tags it applied. */
export async function runMigrations(client: MigrationClient, migrations: Migration[], opts: RunOptions = {}): Promise<string[]> {
  const log = opts.log ?? (() => {});
  const retryDelayMs = opts.retryDelayMs ?? 10_000;
  const deadline = Date.now() + (opts.lockWaitMs ?? 300_000);

  // ponytail: polls pg_try_advisory_lock once a second rather than relying on lock_timeout covering advisory waits.
  while (!(await client.query("select pg_try_advisory_lock($1) as ok", [MIGRATION_LOCK])).rows[0]?.ok) {
    if (Date.now() > deadline) throw new Error("another deploy still holds the migration lock (7281551)");
    await sleep(1_000);
  }
  try {
    await client.query("set lock_timeout = '5s'");
    await client.query("create schema if not exists drizzle");
    await client.query("create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)");
    const applied = (await client.query("select hash, created_at from drizzle.__drizzle_migrations")).rows.map((r) => ({
      hash: String(r.hash),
      when: Number(r.created_at),
    }));

    for (const row of applied) {
      const file = migrations.find((m) => m.when === row.when);
      // A row with no file is a newer release's migration seen by an older one being redeployed: expand-only makes that safe.
      if (file && !file.hashes.includes(row.hash)) {
        throw new Error(`migration ${file.tag} was edited after it was applied (INV-21): add a new migration instead`);
      }
    }

    const done: string[] = [];
    for (const m of migrations) {
      if (applied.some((a) => a.when === m.when)) continue;
      const record = () => client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [m.hashes[0], m.when]);
      const retry = (n: number) => log(`lock timeout, retry ${n} of 3`, m.tag);
      if (m.noTransaction) {
        // Idempotent statements only (IF NOT EXISTS), so a retry or a rerun after a partial run is safe.
        for (const statement of m.statements) await withLockRetry(() => client.query(statement), retryDelayMs, retry);
        await record();
      } else {
        await withLockRetry(
          async () => {
            await client.query("begin");
            try {
              for (const statement of m.statements) await client.query(statement);
              await record();
              await client.query("commit");
            } catch (err) {
              await client.query("rollback");
              throw err;
            }
          },
          retryDelayMs,
          retry,
        );
      }
      log("migration applied", m.tag);
      done.push(m.tag);
    }
    return done;
  } finally {
    // Ending the session releases it too, so a dead connection must not hide the error that killed it.
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => {});
  }
}
