import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { creditLedger } from "../db/schema";
import { currentUser } from "../middleware/require-auth";
import { availableCredits, countInFlight, getBalance } from "../services/credits";

/** The readable ledger: every credit in or out with its reason. Mounted at /api/credits. */
export const creditsRouter = Router();

creditsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const [balance, inFlight, entries] = await Promise.all([
    getBalance(db(), me.id),
    countInFlight(db(), me.id),
    db().select().from(creditLedger).where(eq(creditLedger.userId, me.id)).orderBy(desc(creditLedger.createdAt)).limit(200),
  ]);
  res.json({ balance, inFlight, available: availableCredits(balance, inFlight), entries });
});
