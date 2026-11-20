import type { Db } from "../../src/db/client";

/** What the worker's lease sweep does for closed attempts: the applier writes results, settlement moves the application. */
export async function settleAll(db: Db): Promise<void> {
  const { settleAttempt, unsettledAttempts } = await import("../../src/services/settle");
  for (const id of await unsettledAttempts(db)) await settleAttempt(db, id);
}
