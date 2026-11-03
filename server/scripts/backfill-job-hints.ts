import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../src/db/schema";
import { HINTS_VERSION, refreshJobHints } from "../src/services/normalize-posting";

/**
 * Backfill B-6 (02-database 14.4, WP-42): computes the normalizePosting columns of every job below HINTS_VERSION,
 * 1,000 rows a batch, one batch a second. Resumable and safe beside the poller: it only reads rows that still need it.
 * Needs only DATABASE_URL (the Postgres service's public URL when run from a laptop):
 *   DATABASE_URL=... node --import tsx --import ./scripts/md-register.mjs scripts/backfill-job-hints.ts
 * ponytail: a script the owner runs once; after a HINTS_VERSION bump, WP-23/WP-34's housekeeping calls refreshJobHints.
 */
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const db = drizzle(pool, { schema, casing: "snake_case" });
let total = 0;
let lastId: string | undefined;
for (;;) {
  const batch = await refreshJobHints(db, 1000, lastId);
  if (batch.n === 0) break;
  total += batch.n;
  lastId = batch.lastId;
  console.log(`hints v${HINTS_VERSION}: ${total} jobs`);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
console.log(`done: ${total} jobs refreshed`);
await pool.end();
