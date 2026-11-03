import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { MIGRATION_LOCK, readMigrations, runMigrations, type Migration, type MigrationClient } from "../src/db/migrator";

/** The runner's rules (06-infrastructure 3.7) against a fake client; the real-Postgres race is in migrator.int.test.ts. */

const FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

const migration = (tag: string, when: number, statements: string[], noTransaction = false): Migration => ({
  tag,
  when,
  hashes: [`hash-${tag}`, `crlf-${tag}`],
  noTransaction,
  statements,
});

/** Records every query; `fail` maps a statement to the errors it throws on its first calls. */
function fakeClient(applied: { hash: string; created_at: number }[] = [], fail: Record<string, { code: string }[]> = {}) {
  const log: string[] = [];
  let lockFree = true;
  const client: MigrationClient & { log: string[]; holdLock: () => void } = {
    log,
    holdLock: () => (lockFree = false),
    async query(text, values) {
      log.push(values ? `${text} ${JSON.stringify(values)}` : text);
      if (text.startsWith("select pg_try_advisory_lock")) return { rows: [{ ok: lockFree }] };
      if (text.startsWith("select hash, created_at")) return { rows: applied };
      const err = fail[text]?.shift();
      if (err) throw err;
      return { rows: [] };
    },
  };
  return client;
}

describe("readMigrations", () => {
  it("reads every journal entry, split on drizzle's breakpoints, hashed as drizzle hashed it", () => {
    const ours = readMigrations(FOLDER);
    const drizzles = readMigrationFiles({ migrationsFolder: FOLDER });
    expect(ours.map((m) => m.when)).toEqual(drizzles.map((d) => d.folderMillis));
    ours.forEach((m, i) => {
      expect(m.hashes).toContain(drizzles[i]!.hash);
      expect(m.statements).toEqual(drizzles[i]!.sql.map((s) => s.replace(/\r\n/g, "\n").trim()).filter(Boolean));
    });
    expect(ours[0]!.tag).toBe("0000_init");
  });
});

describe("runMigrations", () => {
  const files = [migration("0000_a", 1, ["create table a()"]), migration("0001_b", 2, ["create table b()", "create index b_idx on b()"])];

  it("holds the advisory lock for the run and applies each pending file in its own transaction", async () => {
    const client = fakeClient();
    expect(await runMigrations(client, files)).toEqual(["0000_a", "0001_b"]);
    expect(client.log[0]).toBe(`select pg_try_advisory_lock($1) as ok [${MIGRATION_LOCK}]`);
    expect(client.log).toContain("set lock_timeout = '5s'");
    const body = client.log.slice(client.log.indexOf("begin"));
    expect(body).toEqual([
      "begin",
      "create table a()",
      'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2) ["hash-0000_a",1]',
      "commit",
      "begin",
      "create table b()",
      "create index b_idx on b()",
      'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2) ["hash-0001_b",2]',
      "commit",
      `select pg_advisory_unlock($1) [${MIGRATION_LOCK}]`,
    ]);
  });

  it("skips applied files, matching drizzle's rows by created_at and either line-end hash", async () => {
    const client = fakeClient([{ hash: "crlf-0000_a", created_at: 1 }]);
    expect(await runMigrations(client, files)).toEqual(["0001_b"]);
    expect(client.log).not.toContain("create table a()");
  });

  it("applies a file the journal places before one already applied (a renumbered merge)", async () => {
    const client = fakeClient([{ hash: "hash-0001_b", created_at: 2 }]);
    expect(await runMigrations(client, files)).toEqual(["0000_a"]);
  });

  it("refuses to run when an applied file was edited (INV-21), and still releases the lock", async () => {
    const client = fakeClient([{ hash: "something-else", created_at: 1 }]);
    await expect(runMigrations(client, files)).rejects.toThrow(/0000_a was edited after it was applied/);
    expect(client.log).not.toContain("begin");
    expect(client.log.at(-1)).toBe(`select pg_advisory_unlock($1) [${MIGRATION_LOCK}]`);
  });

  it("runs a -- kairos:no-transaction file statement by statement", async () => {
    const client = fakeClient();
    await runMigrations(client, [migration("0002_idx", 3, ["create index concurrently if not exists x on a(id)"], true)]);
    expect(client.log).not.toContain("begin");
    expect(client.log).toContain("create index concurrently if not exists x on a(id)");
  });

  it("retries a file whose statement timed out on a lock, up to 3 times", async () => {
    const timeout = { code: "55P03" };
    const client = fakeClient([], { "create table b()": [timeout, timeout, timeout] });
    expect(await runMigrations(client, files, { retryDelayMs: 0 })).toEqual(["0000_a", "0001_b"]);
    expect(client.log.filter((q) => q === "rollback")).toHaveLength(3);

    const stuck = fakeClient([], { "create table a()": [timeout, timeout, timeout, timeout] });
    await expect(runMigrations(stuck, files, { retryDelayMs: 0 })).rejects.toMatchObject({ code: "55P03" });
  });

  it("does not retry other errors", async () => {
    const client = fakeClient([], { "create table a()": [{ code: "42P07" }] });
    await expect(runMigrations(client, files, { retryDelayMs: 0 })).rejects.toMatchObject({ code: "42P07" });
    expect(client.log.filter((q) => q === "begin")).toHaveLength(1);
  });

  it("gives up when another deploy holds the lock past the budget", async () => {
    const client = fakeClient();
    client.holdLock();
    await expect(runMigrations(client, files, { lockWaitMs: 0 })).rejects.toThrow(/holds the migration lock/);
  });
});
