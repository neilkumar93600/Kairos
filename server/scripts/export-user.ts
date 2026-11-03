import { mkdir, writeFile } from "node:fs/promises";
import { buffer } from "node:stream/consumers";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { closeDb, db, type Db } from "../src/db/client";
import { decrypt } from "../src/lib/crypto";
import { storage, USER_BUCKETS, type Storage } from "../src/lib/storage";
import { PRIVACY_REGISTRY } from "../src/services/privacy-registry";

/**
 * Access and portability request (GDPR Arts. 15 and 20, DPDP s. 11; 02-database 16.3; WP-25): every row the user owns
 * in the tables the privacy registry exports, encrypted columns decrypted, credentials and keyed hashes left out, plus
 * the user's files in R2. Run by an operator after confirming the requester's identity, within 30 days:
 *
 *   railway run --service worker -- npx tsx scripts/export-user.ts <userId> --out ./export-<userId>
 *
 * Writes <out>/export.json and <out>/files/<bucket>/<name>. The bundle is personal data: send it over the agreed
 * channel and delete the local copy. ponytail: the ops_audit row (user.export) is a log line until WP-27's table lands.
 */

type Row = Record<string, unknown>;

export interface UserExport {
  generatedAt: string;
  userId: string;
  tables: Record<string, Row[]>;
  files: { bucket: string; name: string }[];
}

/** Rows per exported registry table; bytea values as base64 strings. */
export async function exportRows(database: Db, userId: string): Promise<Record<string, Row[]>> {
  const [account] = (await database.execute<{ email: string }>(sql`select email from "user" where id = ${userId}`)).rows;
  if (!account) throw new Error(`no user ${userId}`);
  const tables: Record<string, Row[]> = {};
  for (const e of PRIVACY_REGISTRY) {
    if (!e.export) continue;
    const t = sql.identifier(e.table);
    const c = sql.identifier(e.column);
    const where = e.parent
      ? sql`${c} in (select id from ${sql.identifier(e.parent)} where user_id = ${userId})`
      : e.by === "email"
        ? sql`lower(${c}) = lower(${account.email})`
        : sql`${c} = ${userId}`;
    const rows = (await database.execute<Row>(sql`select * from ${t} where ${where}`)).rows;
    tables[e.table] = rows.map((row) => {
      const out: Row = {};
      for (const [k, v] of Object.entries(row)) {
        if (e.export && e.export.omit?.includes(k)) continue;
        if (e.export && e.export.decrypt?.includes(k) && Buffer.isBuffer(v)) {
          out[k] = decrypt(v, { table: e.table, id: String(row.id ?? row.user_id), column: k }).toString("utf8");
        } else out[k] = Buffer.isBuffer(v) ? v.toString("base64") : v;
      }
      return out;
    });
  }
  return tables;
}

export async function exportUser(database: Db, userId: string, files: Pick<Storage, "list" | "get"> | null, out: string): Promise<UserExport> {
  const result: UserExport = { generatedAt: new Date().toISOString(), userId, tables: await exportRows(database, userId), files: [] };
  for (const bucket of files ? USER_BUCKETS : []) {
    for (const name of await files!.list(bucket, userId)) {
      const file = await files!.get(`${bucket}/${userId}/${name}`);
      if (!file) continue;
      await mkdir(join(out, "files", bucket), { recursive: true });
      await writeFile(join(out, "files", bucket, name), await buffer(file.body));
      result.files.push({ bucket, name });
    }
  }
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "export.json"), JSON.stringify(result, null, 2));
  return result;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { out: { type: "string" }, "no-files": { type: "boolean", default: false } } });
  const userId = positionals[0];
  if (!userId || !values.out) {
    console.error("usage: npx tsx scripts/export-user.ts <userId> --out <dir> [--no-files]");
    return 2;
  }
  try {
    const result = await exportUser(db(), userId, values["no-files"] ? null : storage(), values.out);
    const rows = Object.values(result.tables).reduce((n, r) => n + r.length, 0);
    // The audit line (ops_audit user.export once WP-27 lands): who ran it is in the Railway CLI's own audit log.
    console.error(JSON.stringify({ action: "user.export", userId, at: result.generatedAt, rows, files: result.files.length }));
    return 0;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`export failed: ${err.message}`);
    process.exit(1);
  });
}
