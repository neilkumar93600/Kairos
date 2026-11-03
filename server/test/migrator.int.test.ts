import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { readMigrations, runMigrations } from "../src/db/migrator";
import { hasTestDb, testDbUrl } from "./helpers/test-db";

/** WP-12 acceptance: two deploys that migrate at once serialize on the advisory lock. Skipped without TEST_DATABASE_URL. */

const migrations = readMigrations(fileURLToPath(new URL("../drizzle", import.meta.url)));
const url = testDbUrl("migrator_race");
const clients: pg.Client[] = [];

async function connect(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  clients.push(client);
  return client;
}

describe.skipIf(!hasTestDb)("migration runner on Postgres", () => {
  afterAll(async () => {
    await Promise.all(clients.map((c) => c.end()));
  });

  it("serializes two concurrent runs: every file applied once, the second run finds nothing to do", async () => {
    const admin = await connect(process.env.TEST_DATABASE_URL!);
    const name = new URL(url).pathname.slice(1);
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.query(`create database "${name}"`);

    const [a, b] = await Promise.all([connect(url), connect(url)]);
    const [ranA, ranB] = await Promise.all([runMigrations(a, migrations), runMigrations(b, migrations)]);

    expect([...ranA, ...ranB].sort()).toEqual(migrations.map((m) => m.tag).sort());
    expect([ranA.length, ranB.length].sort()).toEqual([0, migrations.length]);
    const { rows } = await a.query("select count(*)::int as n from drizzle.__drizzle_migrations");
    expect(rows[0].n).toBe(migrations.length);
    expect(await runMigrations(a, migrations)).toEqual([]);
  });
});
