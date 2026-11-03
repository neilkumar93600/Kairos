import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { baseEnv } from "../lib/env";
import { logger } from "../lib/logger";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let database: Db | undefined;
let poolMax = 10;

/**
 * The worker and the applier size the pool to their job concurrency before their first query (scale-v12), so no job
 * waits for a connection another queue holds. The api keeps 10.
 */
export function sizeDbPool(max: number): void {
  poolMax = max;
}

/**
 * The process pool (pg 8, 02-database 4.4). Drizzle sends every query unnamed, so no prepared statement outlives its
 * transaction and the pool is safe behind PgBouncer in transaction mode. Statement and idle timeouts are set per role
 * (ops/provision-roles.sql), so this file carries none.
 */
export function db(): Db {
  if (!database) {
    pool = new pg.Pool({ connectionString: baseEnv().DATABASE_URL, max: poolMax, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
    // An idle client whose server connection drops emits "error"; without a listener that event kills the process.
    pool.on("error", (err) => logger.warn({ err }, "idle database connection dropped"));
    database = drizzle(pool, { schema, casing: "snake_case" });
  }
  return database;
}

export async function closeDb(): Promise<void> {
  const closing = pool;
  pool = undefined;
  database = undefined;
  await closing?.end();
}

export { schema };
