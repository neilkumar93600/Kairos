import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Db } from "../../src/db/client";
import * as schema from "../../src/db/schema";

/**
 * Integration tests run only when TEST_DATABASE_URL points at a disposable Postgres, for example:
 *   docker run -d --name kairos-test-pg -p 55432:5432 -e POSTGRES_USER=kairos -e POSTGRES_PASSWORD=kairos -e POSTGRES_DB=kairos_test pgvector/pgvector:pg17
 *   TEST_DATABASE_URL=postgres://kairos:kairos@localhost:55432/kairos_test npm test -w @auto-career/server
 * Stable API (other sessions build on it): hasTestDb, testDbUrl, testDb, resetDb, seedUser, closeTestDbs.
 */
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));
const clients = new Map<string, { db: Db; client: postgres.Sql }>();

/**
 * URL of one test file's own database, derived from the database named in TEST_DATABASE_URL
 * (kairos_test -> kairos_test_it_<name>). Test files never truncate each other's rows; two sessions running
 * the suite at the same time isolate by pointing TEST_DATABASE_URL at different database names.
 */
export function testDbUrl(name: string): string {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://localhost/unset");
  url.pathname = `${url.pathname}_it_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
  return url.toString();
}

/** Creates the named database when missing, applies every migration, and returns a cached client. */
export async function testDb(name: string): Promise<Db> {
  const cached = clients.get(name);
  if (cached) return cached.db;
  const dbName = new URL(testDbUrl(name)).pathname.slice(1);
  const admin = postgres(process.env.TEST_DATABASE_URL ?? "", { max: 1, onnotice: () => {} });
  try {
    const found = await admin`select 1 from pg_database where datname = ${dbName}`;
    // 42P04 duplicate_database: another process created it between the check and the create.
    if (found.length === 0) await admin.unsafe(`create database "${dbName}"`).catch((err: { code?: string }) => {
      if (err.code !== "42P04") throw err;
    });
  } finally {
    await admin.end();
  }
  const client = postgres(testDbUrl(name), { max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  clients.set(name, { db, client });
  return db;
}

/** Empties every table in the public schema. Drizzle's migration bookkeeping lives in the drizzle schema and is kept. */
export async function resetDb(db: Db): Promise<void> {
  const rows = (await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`)) as unknown as { tablename: string }[];
  if (rows.length === 0) return;
  await db.execute(sql.raw(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`));
}

/** Inserts a verified user, a free subscriptions row and, when credits > 0, a free credit grant. Returns the user id. */
export async function seedUser(db: Db, opts: { id?: string; credits?: number } = {}): Promise<string> {
  const id = opts.id ?? randomUUID();
  await db.insert(schema.user).values({ id, name: "Test User", email: `${id}@test.local`, emailVerified: true });
  await db.insert(schema.subscriptions).values({ userId: id, plan: "free" });
  if (opts.credits) await db.insert(schema.creditLedger).values({ userId: id, delta: opts.credits, reason: "free_grant" });
  return id;
}

export async function closeTestDbs(): Promise<void> {
  await Promise.all([...clients.values()].map(({ client }) => client.end({ timeout: 5 })));
  clients.clear();
}
