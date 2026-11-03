import pg from "pg";
import { readMigrations, runMigrations } from "./db/migrator";
import { logger } from "./lib/logger";

/**
 * Applies SQL migrations from ./drizzle; Railway runs it as the api's pre-deploy command. It connects directly, not
 * through PgBouncer: the advisory lock, SET and CREATE INDEX CONCURRENTLY need a session of their own. Once roles are
 * provisioned, DATABASE_UNPOOLED_URL signs in as kairos_migrator (owner-actions/WP-12.md).
 */
const url = process.env.DATABASE_UNPOOLED_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_UNPOOLED_URL (or DATABASE_URL) is required");
const client = new pg.Client({ connectionString: url, application_name: "kairos-migrate" });
await client.connect();
try {
  const migrations = readMigrations(process.env.MIGRATIONS_DIR ?? "./drizzle");
  const applied = await runMigrations(client, migrations, { log: (message, tag) => logger.info({ migration: tag }, message) });
  logger.info({ applied: applied.length, total: migrations.length }, "migrations done");
} finally {
  await client.end();
}
