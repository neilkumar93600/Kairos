import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Who is writing (02-database 3.2): 'user' is a request by the signed-in owner, 'ops' an operator repair. Workers,
 * parsers and agents set nothing. The guard triggers (facts_guard, migration 0006) read it through kairos_actor().
 */
export type Actor = "user" | "autopilot" | "ops";

/**
 * Marks the rest of this transaction as written by `actor`. Call it first in every user-facing write; set_config's
 * third argument makes it transaction-local, so it is safe behind PgBouncer and never leaks to the next request.
 * Forgetting it fails closed: the guards refuse a confirm or an edit from an unknown actor.
 */
export async function asActor(tx: Tx, actor: Actor): Promise<void> {
  await tx.execute(sql`select set_config('kairos.actor', ${actor}, true)`);
}
