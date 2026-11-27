import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { creditLedger } from "../db/schema";
import { keysetBefore, pageParams, slicePage, tsKey } from "../lib/pagination";
import { LEDGER_COLUMNS } from "../lib/serializers";
import { currentUser } from "../middleware/require-auth";
import { readCredits } from "../services/credits";

/** The readable ledger: every credit in or out with its reason. Mounted at /api/credits. */
export const creditsRouter = Router();

const LIST = "credits";

/**
 * The balance from the cache and a keyset page of entries (billing-59, 05-api 12.3), in one repeatable-read snapshot, so
 * the entries can never show a charge the balance has not counted. Without a cursor it is the old list: the newest 200.
 */
creditsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const { limit, after } = pageParams(req.query, 200, LIST, ["ts"]);
  const { credits, rows } = await db().transaction(
    async (tx) => ({
      credits: await readCredits(tx, me.id),
      rows: await tx
        .select({ ...LEDGER_COLUMNS, createdKey: tsKey(creditLedger.createdAt) })
        .from(creditLedger)
        .where(and(eq(creditLedger.userId, me.id), after ? keysetBefore([creditLedger.createdAt], ["timestamptz"], creditLedger.id, after) : undefined))
        .orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
        .limit(limit + 1),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const page = slicePage(rows, limit, LIST, (r) => [r.createdKey], (r) => r.id);
  res.json({ ...credits, entries: page.rows.map(({ createdKey: _key, ...entry }) => entry), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
});
