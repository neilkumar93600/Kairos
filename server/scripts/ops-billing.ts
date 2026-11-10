import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { and, asc, eq, sql } from "drizzle-orm";
import { closeDb, db, type Db } from "../src/db/client";
import { applications, creditBalances, creditLedger, opsAudit, stripeEvents } from "../src/db/schema";
import { redriveStripeEvent } from "../src/services/billing-events";
import { adjustCredits, lockCreditBalance, readCredits, refundSubmission } from "../src/services/credits";

/**
 * The operator's billing actions (billing-43, _db/billing.md 5). Each is one transaction with its ops_audit row, under the balance
 * lock, and prints what it did. The admin HTTP routes cannot write the ledger: this is the only way, and ledger-watch reports every
 * admin_adjustment to Sentry. Runbook: docs/runbook/billing.md. Notes and actors are short codes, never free text or an address.
 *
 *   railway run --service worker -- npx tsx scripts/ops-billing.ts dead
 *   railway run --service worker -- npx tsx scripts/ops-billing.ts adjust --actor <you> --user <id> --delta <+n|-n> --note <code>
 *   railway run --service worker -- npx tsx scripts/ops-billing.ts refund --actor <you> --application <id> --note <code>
 *   railway run --service worker -- npx tsx scripts/ops-billing.ts redrive --actor <you> --event <evt_id>
 *   DATABASE_URL=<kairos_migrator's URL> npx tsx scripts/ops-billing.ts repair-balance --actor <you> --user <id>
 *
 * repair-balance alone needs the migrator: no runtime role may write credit_balances. It sets the row to its recount, after LEDGER-2
 * has frozen approvals and someone has looked at why it drifted; the owner then lifts the freeze from /api/admin/flags.
 */

const ACTOR = /^[A-Za-z0-9._:-]{1,100}$/;
/** credit_ledger_note_ck */
const NOTE = /^[A-Za-z0-9 _:=.,/#-]{1,200}$/;
const MAX_ADJUSTMENT = 100_000;

const refused = (why: string) => new Error(`refused: ${why}`);
const audit = (tx: Parameters<Parameters<Db["transaction"]>[0]>[0], row: { actor: string; action: string; target: string; before: unknown; after: unknown }) => tx.insert(opsAudit).values(row);

function checkCodes(actor: string, note?: string): void {
  if (!ACTOR.test(actor)) throw refused("--actor must be a short id, not an address");
  if (note !== undefined && !NOTE.test(note)) throw refused("--note must be a short code: letters, digits and _:=.,/#- only");
}

export async function adjust(d: Db, input: { actor: string; userId: string; delta: number; note: string }) {
  checkCodes(input.actor, input.note);
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > MAX_ADJUSTMENT) throw refused(`--delta must be a whole number, not 0, at most ${MAX_ADJUSTMENT} either way`);
  return d.transaction(async (tx) => {
    const before = await readCredits(tx, input.userId);
    await adjustCredits(tx, { userId: input.userId, delta: input.delta, note: input.note });
    const after = await readCredits(tx, input.userId);
    await audit(tx, { actor: input.actor, action: "credit.adjust", target: `user:${input.userId}`, before: { balance: before.balance }, after: { balance: after.balance, delta: input.delta, note: input.note } });
    return { action: "credit.adjust", userId: input.userId, balance: after.balance };
  });
}

/** Only a submission that was charged, and once: credit_ledger_application_reason_uq turns a second refund into a no-op. */
export async function refund(d: Db, input: { actor: string; applicationId: string; note: string }) {
  checkCodes(input.actor, input.note);
  const [app] = await d.select({ userId: applications.userId }).from(applications).where(eq(applications.id, input.applicationId));
  if (!app) throw refused("no such application");
  return d.transaction(async (tx) => {
    await lockCreditBalance(tx, app.userId);
    const [charged] = await tx.select({ id: creditLedger.id }).from(creditLedger).where(and(eq(creditLedger.applicationId, input.applicationId), eq(creditLedger.reason, "submission")));
    if (!charged) throw refused("this application was never charged");
    const refunded = await refundSubmission(tx, app.userId, input.applicationId, input.note);
    if (!refunded) throw refused("this application was already refunded");
    await audit(tx, { actor: input.actor, action: "credit.refund", target: `application:${input.applicationId}`, before: null, after: { note: input.note } });
    return { action: "credit.refund", applicationId: input.applicationId, balance: (await readCredits(tx, app.userId)).balance };
  });
}

/** A dead event back to received: the queue runs it again. Only dead: a received one is the queue's and the sweep's. */
export async function redrive(d: Db, input: { actor: string; eventId: string }) {
  checkCodes(input.actor);
  return d.transaction(async (tx) => {
    const [event] = await tx.select({ status: stripeEvents.status, redrives: stripeEvents.redrives, lastError: stripeEvents.lastError }).from(stripeEvents).where(eq(stripeEvents.id, input.eventId)).for("update");
    if (!event) throw refused("no such event");
    if (event.status !== "dead") throw refused(`this event is ${event.status}, not dead`);
    await redriveStripeEvent(tx, input.eventId);
    await audit(tx, { actor: input.actor, action: "stripe_event.redrive", target: `stripe_event:${input.eventId}`, before: { status: event.status, redrives: event.redrives, lastError: event.lastError }, after: { status: "received", redrives: event.redrives + 1 } });
    return { action: "stripe_event.redrive", eventId: input.eventId, redrives: event.redrives + 1 };
  });
}

/** The row to its recount, under its own lock, so no ledger insert or status move can slip between the two. */
export async function repairBalance(d: Db, input: { actor: string; userId: string }) {
  checkCodes(input.actor);
  return d.transaction(async (tx) => {
    const before = await lockCreditBalance(tx, input.userId);
    const [after] = await tx
      .update(creditBalances)
      .set({
        balance: sql`(select coalesce(sum(delta), 0)::int from credit_ledger where user_id = ${input.userId})`,
        inFlight: sql`(select count(*)::int from applications where user_id = ${input.userId} and status in ('approved', 'submitting'))`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.userId, input.userId))
      .returning({ balance: creditBalances.balance, inFlight: creditBalances.inFlight });
    await audit(tx, { actor: input.actor, action: "credit_balance.repair", target: `user:${input.userId}`, before, after });
    return { action: "credit_balance.repair", userId: input.userId, before, after };
  });
}

const USAGE = "usage: npx tsx scripts/ops-billing.ts dead | adjust --actor A --user U --delta N --note C | refund --actor A --application ID --note C | redrive --actor A --event E | repair-balance --actor A --user U";

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { actor: { type: "string" }, user: { type: "string" }, delta: { type: "string" }, note: { type: "string" }, application: { type: "string" }, event: { type: "string" } },
  });
  const need = (name: keyof typeof values) => {
    const v = values[name];
    if (!v) throw refused(`--${name} is required`);
    return v;
  };
  try {
    const run: Record<string, () => Promise<unknown>> = {
      dead: () =>
        db()
          .select({ id: stripeEvents.id, type: stripeEvents.type, lastError: stripeEvents.lastError, outcome: stripeEvents.outcome, redrives: stripeEvents.redrives, receivedAt: stripeEvents.receivedAt })
          .from(stripeEvents)
          .where(eq(stripeEvents.status, "dead"))
          .orderBy(asc(stripeEvents.receivedAt)),
      adjust: () => adjust(db(), { actor: need("actor"), userId: need("user"), delta: Number(need("delta")), note: need("note") }),
      refund: () => refund(db(), { actor: need("actor"), applicationId: need("application"), note: need("note") }),
      redrive: () => redrive(db(), { actor: need("actor"), eventId: need("event") }),
      "repair-balance": () => repairBalance(db(), { actor: need("actor"), userId: need("user") }),
    };
    const action = positionals[0] && Object.hasOwn(run, positionals[0]) ? run[positionals[0]] : undefined;
    if (!action) {
      console.error(USAGE);
      return 2;
    }
    console.log(JSON.stringify(await action()));
    return 0;
  } catch (err) {
    console.error((err as Error).message.startsWith("refused:") ? (err as Error).message : "failed: see the log");
    if (!(err as Error).message.startsWith("refused:")) console.error(err);
    return 1;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
