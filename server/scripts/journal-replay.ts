import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { WINDOW_MS, parseJournal, windowKey, type JournalLine } from "../src/jobs/money-journal";
import { backupsStorage } from "../src/lib/backups";
import type { Storage } from "../src/lib/storage";

/**
 * Applies the money journal (src/jobs/money-journal.ts) onto a restored database (R-DR-1 step 8, R-DR-2), in one
 * transaction, rolled back unless --apply:
 *   - credit_ledger: inserts each journaled row the database lacks, with its original id and time. The primary key and
 *     the ledger's unique indexes make a second run, or a row the restore already holds, a no-op (never a double grant
 *     or a double debit). A row whose user or application the restore lacks is listed, not inserted.
 *   - applications: moves a row to its latest journaled status only along the status guard's own transitions and only
 *     into submitting, submitted, failed or withdrawn, states nothing resends, so a restore cannot re-open an application
 *     the employer already received. Any other difference is listed for the operator (06-infrastructure 5.4).
 *   - stripe_events: lists the processed events the restore lacks. They are not inserted: their effect on subscriptions
 *     is not journaled, so they are resent from Stripe and the webhook's idempotency keeps the replayed ledger single.
 *
 *   RESTORE_DATABASE_URL=<restored db> R2_ENDPOINT=... R2_BUCKET_BACKUPS=... R2_BACKUPS_ACCESS_KEY_ID=... \
 *     R2_BACKUPS_SECRET_ACCESS_KEY=... npx tsx scripts/journal-replay.ts --since <ISO> [--until <ISO>] [--apply]
 *
 * --since is the dump's snapshotAt (its manifest) or the PITR restore point; the replay starts REPLAY_MARGIN_MS before
 * it, for transactions that began before the snapshot and committed after. Prints one JSON report.
 */

/** Overlap before --since: a row's created_at is its transaction's start, which can precede the snapshot it missed. */
export const REPLAY_MARGIN_MS = 10 * 60_000;
const PARALLEL_GETS = 16;

type StatusLine = JournalLine & { t: "status" };
type LedgerLine = JournalLine & { t: "ledger" };

/** applications_guard_status v1 (drizzle/0006_backstops.sql), restricted to moves into a state nothing resends. */
const CLOSING: Record<string, readonly string[]> = {
  draft: ["withdrawn"],
  approved: ["submitting", "submitted", "failed", "withdrawn"],
  submitting: ["submitted", "failed"],
  failed: ["submitted", "withdrawn"],
};

/** What to do with each application's latest journaled status, given the restored statuses. */
export function planStatus(lines: StatusLine[], restored: Map<string, string>) {
  const latest = new Map<string, StatusLine>();
  for (const l of lines) if ((latest.get(l.application)?.at ?? "") <= l.at) latest.set(l.application, l);
  const apply: StatusLine[] = [];
  const differs: { application: string; db: string; journal: string }[] = [];
  const missing: string[] = [];
  for (const l of latest.values()) {
    const db = restored.get(l.application);
    if (db === undefined) missing.push(l.application);
    else if (db === l.status) continue;
    else if (CLOSING[db]?.includes(l.status)) apply.push(l);
    else differs.push({ application: l.application, db, journal: l.status });
  }
  return { apply, differs, missing };
}

/** The journal from REPLAY_MARGIN_MS before `since` up to `until`; `gaps` names the window starts with no object. */
export async function loadJournal(store: Pick<Storage, "get">, since: number, until: number) {
  const starts: number[] = [];
  for (let w = Math.floor((since - REPLAY_MARGIN_MS) / WINDOW_MS) * WINDOW_MS; w < until; w += WINDOW_MS) starts.push(w);
  const lines: JournalLine[] = [];
  const gaps: string[] = [];
  for (let i = 0; i < starts.length; i += PARALLEL_GETS) {
    const batch = starts.slice(i, i + PARALLEL_GETS);
    const files = await Promise.all(batch.map(async (w) => {
      const file = await store.get(windowKey(w));
      return file ? text(file.body) : null;
    }));
    files.forEach((body, j) => (body === null ? gaps.push(new Date(batch[j]!).toISOString()) : lines.push(...parseJournal(body))));
  }
  return { lines, windows: starts.length, gaps };
}

/** Applies the journal to the database behind `client`; commits only when `apply`. */
export async function replay(client: pg.ClientBase, lines: JournalLine[], apply: boolean) {
  const ledger = [...new Map(lines.filter((l): l is LedgerLine => l.t === "ledger").map((l) => [l.id, l])).values()];
  const statuses = lines.filter((l): l is StatusLine => l.t === "status");
  const stripe = [...new Set(lines.flatMap((l) => (l.t === "stripe" ? [l.id] : [])))];
  const ids = async (query: string, values: unknown[]) => new Set((await client.query<{ id: string }>(query, values)).rows.map((r) => r.id));

  await client.query("begin");
  try {
    // Applications first, so a ledger debit lands on a row already closed.
    const appIds = [...new Set(statuses.map((l) => l.application))];
    const restored = new Map(
      (await client.query<{ id: string; status: string }>("select id::text, status::text from applications where id = any($1::uuid[])", [appIds])).rows.map((r) => [r.id, r.status]),
    );
    const plan = planStatus(statuses, restored);
    for (const l of plan.apply) {
      // Compare-and-set on the status the plan saw; the guard trigger checks the move again and stamps updated_at.
      await client.query(
        "update applications set status = $2::application_status, submitted_at = coalesce($3::timestamptz, submitted_at) where id = $1::uuid and status = $4::application_status",
        [l.application, l.status, l.submitted_at, restored.get(l.application)],
      );
    }

    const present = await ids("select id::text from credit_ledger where id = any($1::uuid[])", [ledger.map((l) => l.id)]);
    const todo = ledger.filter((l) => !present.has(l.id));
    const rows = todo.map((l) => ({ id: l.id, user_id: l.user, delta: l.delta, reason: l.reason, application_id: l.application, stripe_invoice_id: l.invoice, note: l.note, created_at: l.at }));
    const inserted = await ids(
      `insert into credit_ledger (id, user_id, delta, reason, application_id, stripe_invoice_id, note, created_at)
       select r.id, r.user_id, r.delta, r.reason::credit_reason, r.application_id, r.stripe_invoice_id, r.note, r.created_at
         from jsonb_to_recordset($1::jsonb) as r(id uuid, user_id text, delta int, reason text, application_id uuid,
                                                 stripe_invoice_id text, note text, created_at timestamptz)
        where exists (select from "user" u where u.id = r.user_id)
          and (r.application_id is null or exists (select from applications a where a.id = r.application_id))
       on conflict do nothing
       returning id::text`,
      [JSON.stringify(rows)],
    );
    const knownUsers = await ids(`select id from "user" where id = any($1::text[])`, [todo.map((l) => l.user)]);
    const knownApps = await ids("select id::text from applications where id = any($1::uuid[])", [todo.flatMap((l) => (l.application ? [l.application] : []))]);
    const skipped = todo
      .filter((l) => !inserted.has(l.id))
      .map((l) => ({
        id: l.id,
        user: l.user,
        why: !knownUsers.has(l.user) ? "user not in the restore" : l.application && !knownApps.has(l.application) ? "application not in the restore" : "an equivalent row is already there",
      }));

    const processed = await ids("select id from stripe_events where id = any($1::text[])", [stripe]);
    const report = {
      applied: apply,
      ledger: { journaled: ledger.length, alreadyPresent: present.size, inserted: inserted.size, skipped },
      applications: {
        journaled: appIds.length,
        closed: plan.apply.map((l) => ({ application: l.application, from: restored.get(l.application), to: l.status })),
        differs: plan.differs,
        missing: plan.missing,
      },
      stripeEventsToResend: stripe.filter((id) => !processed.has(id)),
    };
    await client.query(apply ? "commit" : "rollback");
    return report;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { since: { type: "string" }, until: { type: "string" }, apply: { type: "boolean", default: false } } });
  const since = Date.parse(values.since ?? "");
  const until = values.until ? Date.parse(values.until) : Date.now();
  if (!Number.isFinite(since) || !Number.isFinite(until)) {
    console.error("usage: npx tsx scripts/journal-replay.ts --since <ISO time> [--until <ISO time>] [--apply]");
    return 2;
  }
  const url = process.env.RESTORE_DATABASE_URL;
  // Run through `railway run --service <worker>` for the R2 token, DATABASE_URL is the live database: never the target.
  if (!url || url === process.env.DATABASE_URL) {
    console.error("RESTORE_DATABASE_URL must name the restored database (and differ from DATABASE_URL).");
    return 2;
  }
  const journal = await loadJournal(backupsStorage(), since, until);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const report = await replay(client, journal.lines, values.apply);
    console.log(JSON.stringify({ windows: journal.windows, gaps: journal.gaps, ...report }, null, 2));
    if (!values.apply) console.error("dry run: rolled back. Re-run with --apply to commit.");
    return 0;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`journal replay failed: ${err.message}`);
    process.exit(1);
  });
}
