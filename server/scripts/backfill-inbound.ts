import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { closeDb, db, type Db } from "../src/db/client";
import { env } from "../src/lib/env";
import { capBody, encryptBody } from "../src/services/inbound";

/**
 * The inbound_emails backfill (WP-24, _db/messaging.md 10.3 and 10.5). Idempotent, in batches of 500, run as kairos_worker
 * with DATA_KEKS, after the previous release's worker has stopped (owner-actions/WP-24.md has the whole order):
 *
 *   railway run --service worker -- npx tsx scripts/backfill-inbound.ts                  # encrypt; plaintext stays
 *   railway run --service worker -- npx tsx scripts/backfill-inbound.ts --null-plaintext # later: empty text_body
 *
 * The first run keeps text_body, because the previous release reads only that column and a rollback must still work.
 * --null-plaintext refuses while INBOUND_PLAINTEXT_DUAL_WRITE is on: new mail would bring plaintext straight back, and
 * the flag being on means the previous release may still be wanted. It only empties rows that have ciphertext, so a
 * row it skipped loses nothing. An empty text_body is a body the old retention rule purged; it has nothing to encrypt.
 */

const BATCH = 500;

export interface BackfillReport {
  markers: number;
  bounded: number;
  encrypted: number;
  nulled: number;
  /** Rows still holding plaintext, and rows holding it with no ciphertext. */
  plaintextLeft: number;
  unencryptedLeft: number;
}

async function batched(database: Db, statement: () => ReturnType<typeof sql>): Promise<number> {
  let total = 0;
  for (;;) {
    const n = (await database.execute(statement())).rowCount ?? 0;
    total += n;
    if (n < BATCH) return total;
  }
}

/** Marks rows the previous release classified (regex only, linked by name), and cuts legacy senders and subjects. */
export async function markLegacy(database: Db): Promise<{ markers: number; bounded: number }> {
  const markers = await batched(database, () => sql`
    UPDATE inbound_emails
       SET rule_kind = kind, classified_at = received_at,
           linked_by = CASE WHEN application_id IS NULL THEN 'none' ELSE 'company_name' END
     WHERE id IN (SELECT id FROM inbound_emails WHERE kind IS NOT NULL AND classified_at IS NULL LIMIT ${BATCH})`);
  const bounded = await batched(database, () => sql`
    UPDATE inbound_emails SET sender = left(sender, 320), subject = left(subject, 500)
     WHERE id IN (SELECT id FROM inbound_emails WHERE char_length(sender) > 320 OR char_length(subject) > 500 LIMIT ${BATCH})`);
  return { markers, bounded };
}

/** Writes the encrypted body and preview of every row with plaintext and no ciphertext. text_body stays. */
export async function encryptRows(database: Db): Promise<number> {
  let total = 0;
  for (;;) {
    const { rows } = await database.execute<{ id: string; text_body: string }>(sql`
      SELECT id, text_body FROM inbound_emails
       WHERE text_body_enc IS NULL AND text_body <> '' AND hidden_reason IS NULL
       LIMIT ${BATCH}`);
    for (const row of rows) {
      const { textBodyEnc, previewEnc } = encryptBody(row.id, capBody(row.text_body));
      if (!textBodyEnc) throw new Error("DATA_KEKS is not set");
      await database.execute(sql`
        UPDATE inbound_emails SET text_body_enc = ${textBodyEnc}, preview_enc = ${previewEnc}
         WHERE id = ${row.id} AND text_body_enc IS NULL AND text_body IS NOT NULL`);
    }
    total += rows.length;
    if (rows.length < BATCH) return total;
  }
}

/** Empties text_body where the ciphertext exists, or where it holds nothing. Never touches a row it would lose. */
export async function nullPlaintext(database: Db): Promise<number> {
  return batched(database, () => sql`
    UPDATE inbound_emails SET text_body = NULL
     WHERE id IN (SELECT id FROM inbound_emails WHERE text_body IS NOT NULL AND (text_body_enc IS NOT NULL OR text_body = '') LIMIT ${BATCH})`);
}

export async function backfill(database: Db, opts: { nullPlaintext: boolean; dualWrite: boolean }): Promise<BackfillReport> {
  if (opts.nullPlaintext && opts.dualWrite) {
    throw new Error("INBOUND_PLAINTEXT_DUAL_WRITE is on: new mail would bring plaintext back. Set it to 0 on the api and here first (owner-actions/WP-24.md)");
  }
  const { markers, bounded } = await markLegacy(database);
  const encrypted = await encryptRows(database);
  const nulled = opts.nullPlaintext ? await nullPlaintext(database) : 0;
  const { rows } = await database.execute<{ plaintext: number; unencrypted: number }>(sql`
    SELECT count(*) FILTER (WHERE text_body IS NOT NULL)::int AS plaintext,
           count(*) FILTER (WHERE text_body <> '' AND text_body_enc IS NULL)::int AS unencrypted
      FROM inbound_emails`);
  const report = { markers, bounded, encrypted, nulled, plaintextLeft: rows[0]!.plaintext, unencryptedLeft: rows[0]!.unencrypted };
  await database.execute(sql`
    INSERT INTO ops_audit (actor, action, target, after)
    VALUES ('system:backfill-inbound', 'backfill_inbound', 'inbound_emails', ${JSON.stringify(report)}::jsonb)`);
  return report;
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { "null-plaintext": { type: "boolean", default: false } } });
  try {
    const report = await backfill(db(), { nullPlaintext: values["null-plaintext"]!, dualWrite: env().INBOUND_PLAINTEXT_DUAL_WRITE });
    console.log(JSON.stringify(report));
    return report.unencryptedLeft === 0 ? 0 : 1;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`backfill failed: ${err.message}`);
    process.exit(1);
  });
}
