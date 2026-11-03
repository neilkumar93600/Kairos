import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { closeDb, db } from "../src/db/client";
import { eraseUser, erasureUserHash, tombstoneStore } from "../src/services/erasure";

/**
 * Operator erasure (WP-25; 02-database 16.3): for a request that arrives by email or the contact form from someone who
 * cannot sign in, after the operator confirmed it is the account holder. Same path as Settings > Delete account, minus
 * the request-time Stripe cancel: the erasure worker's customer delete cancels any live subscription.
 *
 *   railway run --service worker -- npx tsx scripts/erase-user.ts <userId> [--apply]
 */
async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { apply: { type: "boolean", default: false } } });
  const userId = positionals[0];
  if (!userId) {
    console.error("usage: npx tsx scripts/erase-user.ts <userId> [--apply]");
    return 2;
  }
  const hash = erasureUserHash(userId);
  if (!values.apply) {
    console.error(`dry run: would erase the user with hash ${hash.slice(0, 32)}. Re-run with --apply.`);
    return 0;
  }
  try {
    const erased = await eraseUser(db(), userId, "operator", tombstoneStore());
    console.log(JSON.stringify({ action: "user.erase", userHash: hash.slice(0, 32), erased: erased !== null, at: new Date().toISOString() }));
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
