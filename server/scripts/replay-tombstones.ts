import { text } from "node:stream/consumers";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { erasedEmails, user } from "../src/db/schema";
import { createStorage, type Storage } from "../src/lib/storage";
import { eraseUser, erasureUserHash, parseTombstone } from "../src/services/erasure";

/**
 * Tombstone replay after a restore (R-DR-1 step 5b, 06-infrastructure 5.6; WP-25). Reads every tombstone in R2, puts
 * back each erased address the restored database lacks (no second free grant), and erases again every user the restore
 * brought back. Their tasks are recreated, so the worker re-runs the other stores, which are idempotent (an R2 prefix
 * already empty, a Stripe customer already deleted). Run it against the restored database BEFORE it takes traffic:
 *
 *   RESTORE_DATABASE_URL=<restored db> railway run --service worker -- npx tsx scripts/replay-tombstones.ts [--apply]
 *
 * Without --apply it only reports. Every tombstone is replayed, not only those after the restore point: a user absent
 * from the restore costs one hash, and nothing older can come back either.
 */

export async function replayTombstones(database: Db, store: Pick<Storage, "list" | "get">, apply: boolean) {
  const tombstones = [];
  for (const name of await store.list("tombstones", "users")) {
    const file = await store.get(`tombstones/users/${name}`);
    if (file) tombstones.push(parseTombstone(await text(file.body)));
  }
  const present = new Set((await database.select({ h: erasedEmails.emailHash }).from(erasedEmails)).map((r) => r.h));
  const missingEmails = [...new Set(tombstones.map((t) => t.emailHash))].filter((h) => !present.has(h));
  const wanted = new Set(tombstones.map((t) => t.userHash));
  // ponytail: one HMAC per restored user, fine to some hundred thousand users; the tombstones never hold an id.
  const back = (await database.select({ id: user.id }).from(user)).map((u) => u.id).filter((id) => wanted.has(erasureUserHash(id)));

  if (apply) {
    if (missingEmails.length) await database.insert(erasedEmails).values(missingEmails.map((emailHash) => ({ emailHash }))).onConflictDoNothing();
    for (const id of back) await eraseUser(database, id, "replay");
  }
  return { applied: apply, tombstones: tombstones.length, erasedEmailsRestored: missingEmails.length, usersErasedAgain: back.length };
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { apply: { type: "boolean", default: false } } });
  const url = process.env.RESTORE_DATABASE_URL;
  if (!url || url === process.env.DATABASE_URL) {
    console.error("RESTORE_DATABASE_URL must name the restored database (and differ from DATABASE_URL).");
    return 2;
  }
  const e = process.env;
  const missing = ["R2_ENDPOINT", "R2_BUCKET_TOMBSTONES", "R2_TOMBSTONES_ACCESS_KEY_ID", "R2_TOMBSTONES_SECRET_ACCESS_KEY"].filter((k) => !e[k]);
  if (missing.length) {
    console.error(`missing ${missing.join(", ")} (the tombstones bucket and its token)`);
    return 2;
  }
  const store = createStorage({
    endpoint: e.R2_ENDPOINT,
    buckets: { tombstones: { name: e.R2_BUCKET_TOMBSTONES!, accessKeyId: e.R2_TOMBSTONES_ACCESS_KEY_ID!, secretAccessKey: e.R2_TOMBSTONES_SECRET_ACCESS_KEY! } },
  });
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    const report = await replayTombstones(drizzle(pool, { schema, casing: "snake_case" }), store, values.apply);
    console.log(JSON.stringify(report, null, 2));
    if (!values.apply) console.error("dry run: nothing written. Re-run with --apply.");
    return 0;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`tombstone replay failed: ${err.message}`);
    process.exit(1);
  });
}
