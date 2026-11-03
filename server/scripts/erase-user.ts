import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/client";
import { user } from "../src/db/schema";
import { eraseUser, erasureUserHash, tombstoneStore } from "../src/services/erasure";

/**
 * Operator erasure (WP-25; 02-database 16.3): for a request that arrives by email or the contact form from someone who
 * cannot sign in, after the operator confirmed it is the account holder. Same path as Settings > Delete account, minus
 * the request-time Stripe cancel: the erasure worker's customer delete cancels any live subscription. Irreversible, so
 * the dry run shows whose account the id is, and --apply needs that address typed back:
 *
 *   railway run --service worker -- npx tsx scripts/erase-user.ts <userId>                       # who is it?
 *   railway run --service worker -- npx tsx scripts/erase-user.ts <userId> --apply --confirm <email>
 */

/** Null when --apply may go ahead, else why not. Case-insensitive, nothing else forgiven. */
export function confirmationProblem(account: { email: string } | undefined, confirm: string | undefined): string | null {
  if (!account) return "no such user";
  if (!confirm) return "--apply needs --confirm <the account's email>";
  return confirm.trim().toLowerCase() === account.email.toLowerCase() ? null : "--confirm does not match the account's email";
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true, options: { apply: { type: "boolean", default: false }, confirm: { type: "string" } },
  });
  const userId = positionals[0];
  if (!userId) {
    console.error("usage: npx tsx scripts/erase-user.ts <userId> [--apply --confirm <email>]");
    return 2;
  }
  try {
    const [account] = await db().select({ email: user.email, createdAt: user.createdAt }).from(user).where(eq(user.id, userId));
    if (!values.apply) {
      console.error(account ? `dry run: ${userId} is ${account.email}, created ${account.createdAt.toISOString()}. Re-run with --apply --confirm ${account.email}.` : "dry run: no such user");
      return account ? 0 : 1;
    }
    const problem = confirmationProblem(account, values.confirm);
    if (problem) {
      console.error(`refused: ${problem}`);
      return 2;
    }
    const erased = await eraseUser(db(), userId, "operator", tombstoneStore());
    // ponytail: printed, not stored, until WP-27's ops_audit lands; then an ops_audit row (actor the user id, action
    // user.erase, target 'user-data'), which the erasure worker pseudonymises with the rest.
    console.log(JSON.stringify({ action: "user.erase", userHash: erasureUserHash(userId).slice(0, 32), erased: erased !== null, at: new Date().toISOString() }));
    return 0;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err: Error) => {
    console.error(`erase failed: ${err.message}`);
    process.exit(1);
  });
}
